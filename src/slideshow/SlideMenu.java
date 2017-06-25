package slideshow;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;

/**
 *
 * @author pwv
 */
public class SlideMenu extends JPopupMenu {

	Gui gui;
	static final Logger	log = Logger.getLogger( "slideshow.SlideMenu" );
	final dosomething		act = new dosomething();
	final JMenuItem			pause = new JMenuItem("Pause");
	final JMenuItem			resume = new JMenuItem("Resume");
	final JMenuItem			setTiming = new JMenuItem("Set image timing");
	final JMenuItem			closeMenu = new JMenuItem("Close this menu (ESC");
	
	public SlideMenu(Gui gui) {
		log.setLevel(Level.FINER);
		this.gui=gui;
		add(pause);				pause.addActionListener(act);
		add(resume);			resume.addActionListener(act);
		add(setTiming);		setTiming.addActionListener(act);
		add(closeMenu);		closeMenu.addActionListener(act);
	}
	
	public class dosomething implements ActionListener {
		@Override
		public void actionPerformed(ActionEvent e) {
			switch (e.getActionCommand()) {
				case "Pause" :
					gui.timer1.stop();
					break;
				case "Resume" : 
					log.finer("SlideMenu! restart timing");
					gui.timer1.restart();
					break;
				case "Set image timing":
					String s = (String)JOptionPane.showInputDialog(
											gui,
											"Set image timing in milliseconds (positive integer)\n",
											e.getActionCommand(),
											JOptionPane.QUESTION_MESSAGE,
											null,  null, "15000");

					if (s.chars().allMatch( Character::isDigit ))
						gui.timer1.setDelay(Integer.parseInt(s));
					else 
						JOptionPane.showMessageDialog(gui, s + " is not a positive integer!", e.getActionCommand(), JOptionPane.ERROR_MESSAGE);
					break;
				default: log.warning("SlideMenu! Unknown menu option was selected");
			}
		}
	}
}
